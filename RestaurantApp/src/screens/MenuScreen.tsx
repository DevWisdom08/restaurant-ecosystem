import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';

interface MenuItem {
  item_id: number;
  item_name: string;
  description: string;
  base_price: number;
  image_url: string;
  category_name: string;
}

const MenuScreen = ({ navigation }: any) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('https://your-api.com/api/v1/menu/categories');
      // const data = await response.json();
      
      // Mock data for now
      const mockData: MenuItem[] = [
        {
          item_id: 1,
          item_name: 'Burger Deluxe',
          description: 'Juicy beef burger with cheese',
          base_price: 12.99,
          image_url: 'https://via.placeholder.com/150',
          category_name: 'Main Course',
        },
        {
          item_id: 2,
          item_name: 'Caesar Salad',
          description: 'Fresh romaine with caesar dressing',
          base_price: 9.99,
          image_url: 'https://via.placeholder.com/150',
          category_name: 'Salads',
        },
      ];
      
      setMenuItems(mockData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching menu:', error);
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ItemDetail', { item })}
    >
      <Image
        source={{ uri: item.image_url }}
        style={styles.image}
      />
      <View style={styles.cardContent}>
        <Text style={styles.itemName}>{item.item_name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.price}>${item.base_price.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Menu</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <Text>Loading menu...</Text>
        </View>
      ) : (
        <FlatList
          data={menuItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.item_id.toString()}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#e0e0e0',
  },
  cardContent: {
    padding: 16,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: '#666',
    marginBottom: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
});

export default MenuScreen;

