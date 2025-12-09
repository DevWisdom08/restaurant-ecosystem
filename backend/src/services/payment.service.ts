import axios from 'axios';
import { logger } from '../config/logger';
import { PaymentError } from '../middleware/errorHandler';

interface AuthorizeNetConfig {
  apiLoginId: string;
  transactionKey: string;
  environment: 'sandbox' | 'production';
  endpoint: string;
}

interface TokenizeCardRequest {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  billingZip: string;
}

interface TokenizeCardResponse {
  payment_token: string;
  customer_profile_id: string;
  payment_profile_id: string;
  card_last_four: string;
  card_brand: string;
}

interface ChargeRequest {
  customerProfileId: string;
  paymentProfileId: string;
  amount: number;
  invoiceNumber: string;
  description: string;
}

interface ChargeResponse {
  success: boolean;
  transaction_id: string;
  authorization_code: string;
  response_code: string;
  message: string;
  card_last_four: string;
  card_brand: string;
}

interface RefundRequest {
  transactionId: string;
  amount: number;
  cardLastFour: string;
}

interface RefundResponse {
  success: boolean;
  transaction_id: string;
  message: string;
}

export class PaymentService {
  private config: AuthorizeNetConfig;
  
  constructor() {
    this.config = {
      apiLoginId: process.env.AUTHORIZE_NET_API_LOGIN_ID || '',
      transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY || '',
      environment: (process.env.AUTHORIZE_NET_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      endpoint: process.env.AUTHORIZE_NET_ENVIRONMENT === 'production'
        ? 'https://api.authorize.net/xml/v1/request.api'
        : 'https://apitest.authorize.net/xml/v1/request.api'
    };
  }
  
  /**
   * Tokenize credit card and create customer payment profile
   */
  async tokenizeCard(data: TokenizeCardRequest): Promise<TokenizeCardResponse> {
    try {
      logger.info('Tokenizing credit card');
      
      const requestBody = {
        createCustomerProfileRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey
          },
          profile: {
            paymentProfiles: {
              customerType: 'individual',
              payment: {
                creditCard: {
                  cardNumber: data.cardNumber,
                  expirationDate: `${data.expiryYear}-${data.expiryMonth}`,
                  cardCode: data.cvv
                }
              },
              billTo: {
                zip: data.billingZip
              }
            }
          },
          validationMode: this.config.environment === 'production' ? 'liveMode' : 'testMode'
        }
      };
      
      const response = await axios.post(this.config.endpoint, requestBody);
      
      const result = response.data;
      
      if (result.messages.resultCode !== 'Ok') {
        const errorMessage = result.messages.message[0]?.text || 'Card tokenization failed';
        throw new PaymentError(errorMessage, { code: result.messages.message[0]?.code });
      }
      
      // Extract card info from validation response
      const validationMessages = result.messages.message || [];
      const cardType = this.getCardType(data.cardNumber);
      
      const tokenResponse: TokenizeCardResponse = {
        payment_token: result.customerProfileId + ':' + result.customerPaymentProfileIdList[0],
        customer_profile_id: result.customerProfileId,
        payment_profile_id: result.customerPaymentProfileIdList[0],
        card_last_four: data.cardNumber.slice(-4),
        card_brand: cardType
      };
      
      logger.info('Card tokenized successfully');
      
      return tokenResponse;
      
    } catch (error: any) {
      logger.error('Card tokenization error:', error);
      
      if (error.response?.data) {
        const errorData = error.response.data;
        const errorMessage = errorData.messages?.message[0]?.text || 'Tokenization failed';
        throw new PaymentError(errorMessage, errorData);
      }
      
      throw new PaymentError('Failed to tokenize card', error);
    }
  }
  
  /**
   * Charge a customer payment profile
   */
  async chargeCustomerProfile(data: ChargeRequest): Promise<ChargeResponse> {
    try {
      logger.info(`Charging customer profile ${data.customerProfileId} for $${data.amount}`);
      
      const requestBody = {
        createTransactionRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey
          },
          transactionRequest: {
            transactionType: 'authCaptureTransaction',
            amount: data.amount.toFixed(2),
            profile: {
              customerProfileId: data.customerProfileId,
              paymentProfile: {
                paymentProfileId: data.paymentProfileId
              }
            },
            order: {
              invoiceNumber: data.invoiceNumber,
              description: data.description
            },
            processingOptions: {
              isSubsequentAuth: 'false'
            }
          }
        }
      };
      
      const response = await axios.post(this.config.endpoint, requestBody);
      
      const result = response.data;
      
      if (result.messages.resultCode !== 'Ok') {
        const errorMessage = result.messages.message[0]?.text || 'Payment failed';
        throw new PaymentError(errorMessage, {
          code: result.messages.message[0]?.code,
          response: result
        });
      }
      
      const transactionResponse = result.transactionResponse;
      
      if (transactionResponse.responseCode !== '1') {
        // Response codes: 1 = Approved, 2 = Declined, 3 = Error, 4 = Held for Review
        const errorMessage = transactionResponse.errors?.[0]?.errorText || 'Transaction declined';
        throw new PaymentError(errorMessage, {
          response_code: transactionResponse.responseCode,
          transaction_response: transactionResponse
        });
      }
      
      const chargeResponse: ChargeResponse = {
        success: true,
        transaction_id: transactionResponse.transId,
        authorization_code: transactionResponse.authCode,
        response_code: transactionResponse.responseCode,
        message: transactionResponse.messages?.[0]?.description || 'Payment successful',
        card_last_four: transactionResponse.accountNumber?.slice(-4) || '',
        card_brand: transactionResponse.accountType || ''
      };
      
      logger.info(`Payment successful - Transaction ID: ${chargeResponse.transaction_id}`);
      
      return chargeResponse;
      
    } catch (error: any) {
      logger.error('Payment charge error:', error);
      
      if (error instanceof PaymentError) {
        throw error;
      }
      
      if (error.response?.data) {
        const errorData = error.response.data;
        const errorMessage = errorData.transactionResponse?.errors?.[0]?.errorText || 
                            errorData.messages?.message[0]?.text || 
                            'Payment processing failed';
        throw new PaymentError(errorMessage, errorData);
      }
      
      throw new PaymentError('Failed to process payment', error);
    }
  }
  
  /**
   * Refund a transaction
   */
  async refundTransaction(data: RefundRequest): Promise<RefundResponse> {
    try {
      logger.info(`Refunding transaction ${data.transactionId} for $${data.amount}`);
      
      const requestBody = {
        createTransactionRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey
          },
          transactionRequest: {
            transactionType: 'refundTransaction',
            amount: data.amount.toFixed(2),
            payment: {
              creditCard: {
                cardNumber: data.cardLastFour,
                expirationDate: 'XXXX'
              }
            },
            refTransId: data.transactionId
          }
        }
      };
      
      const response = await axios.post(this.config.endpoint, requestBody);
      
      const result = response.data;
      
      if (result.messages.resultCode !== 'Ok') {
        const errorMessage = result.messages.message[0]?.text || 'Refund failed';
        throw new PaymentError(errorMessage, {
          code: result.messages.message[0]?.code,
          response: result
        });
      }
      
      const transactionResponse = result.transactionResponse;
      
      if (transactionResponse.responseCode !== '1') {
        const errorMessage = transactionResponse.errors?.[0]?.errorText || 'Refund declined';
        throw new PaymentError(errorMessage, {
          response_code: transactionResponse.responseCode,
          transaction_response: transactionResponse
        });
      }
      
      const refundResponse: RefundResponse = {
        success: true,
        transaction_id: transactionResponse.transId,
        message: 'Refund processed successfully'
      };
      
      logger.info(`Refund successful - Transaction ID: ${refundResponse.transaction_id}`);
      
      return refundResponse;
      
    } catch (error: any) {
      logger.error('Refund error:', error);
      
      if (error instanceof PaymentError) {
        throw error;
      }
      
      if (error.response?.data) {
        const errorData = error.response.data;
        const errorMessage = errorData.transactionResponse?.errors?.[0]?.errorText || 
                            errorData.messages?.message[0]?.text || 
                            'Refund processing failed';
        throw new PaymentError(errorMessage, errorData);
      }
      
      throw new PaymentError('Failed to process refund', error);
    }
  }
  
  /**
   * Void a transaction (same-day cancellation)
   */
  async voidTransaction(transactionId: string): Promise<void> {
    try {
      logger.info(`Voiding transaction ${transactionId}`);
      
      const requestBody = {
        createTransactionRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey
          },
          transactionRequest: {
            transactionType: 'voidTransaction',
            refTransId: transactionId
          }
        }
      };
      
      const response = await axios.post(this.config.endpoint, requestBody);
      
      const result = response.data;
      
      if (result.messages.resultCode !== 'Ok') {
        const errorMessage = result.messages.message[0]?.text || 'Void failed';
        throw new PaymentError(errorMessage, {
          code: result.messages.message[0]?.code
        });
      }
      
      logger.info(`Transaction ${transactionId} voided successfully`);
      
    } catch (error: any) {
      logger.error('Void transaction error:', error);
      throw new PaymentError('Failed to void transaction', error);
    }
  }
  
  /**
   * Get card type from card number
   */
  private getCardType(cardNumber: string): string {
    const patterns: Record<string, RegExp> = {
      'Visa': /^4/,
      'Mastercard': /^5[1-5]/,
      'American Express': /^3[47]/,
      'Discover': /^6(?:011|5)/,
      'Diners Club': /^3(?:0[0-5]|[68])/,
      'JCB': /^35/
    };
    
    for (const [brand, pattern] of Object.entries(patterns)) {
      if (pattern.test(cardNumber)) {
        return brand;
      }
    }
    
    return 'Unknown';
  }
}

// Export singleton instance
export const paymentService = new PaymentService();

