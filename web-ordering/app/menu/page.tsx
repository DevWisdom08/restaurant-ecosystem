'use client';

import { useState, useEffect } from 'react';

interface MenuItem {
  item_id: number;
  item_name: string;
  description: string;
  base_price: number;
  category_name: string;
}

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API call
    // fetch('https://your-api.com/api/v1/menu/categories')
    
    // Mock data for now
    const mockData: MenuItem[] = [
      {
        item_id: 1,
        item_name: 'Burger Deluxe',
        description: 'Juicy beef burger with cheese, lettuce, tomato',
        base_price: 12.99,
        category_name: 'Main Course',
      },
      {
        item_id: 2,
        item_name: 'Caesar Salad',
        description: 'Fresh romaine with caesar dressing and croutons',
        base_price: 9.99,
        category_name: 'Salads',
      },
      {
        item_id: 3,
        item_name: 'Margherita Pizza',
        description: 'Classic pizza with tomato, mozzarella, and basil',
        base_price: 14.99,
        category_name: 'Main Course',
      },
    ];
    
    setMenuItems(mockData);
    setLoading(false);
  }, []);

  const addToCart = (item: MenuItem) => {
    // TODO: Add to cart logic
    alert(`Added ${item.item_name} to cart!`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Menu</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-600">Loading menu...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map((item) => (
              <div key={item.item_id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-6">
                  <div className="text-sm text-blue-600 mb-2">{item.category_name}</div>
                  <h3 className="text-xl font-semibold mb-2">{item.item_name}</h3>
                  <p className="text-gray-600 mb-4">{item.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-blue-600">
                      ${item.base_price.toFixed(2)}
                    </span>
                    <button
                      onClick={() => addToCart(item)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

