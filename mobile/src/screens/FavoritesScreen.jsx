import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api.js';
import { C } from '../theme.js';
import { Btn, Empty, ProductCard, Spinner } from '../components.jsx';

export default function FavoritesScreen({ navigation }) {
  const [favs, setFavs] = useState(null);

  useFocusEffect(
    useCallback(() => {
      api('/auth/favorites').then((d) => setFavs(d.favorites));
    }, [])
  );

  if (!favs) return <Spinner />;
  if (!favs.length) {
    return <Empty icon="♥" text="No favorites yet." action={<Btn title="Browse products" onPress={() => navigation.navigate('HomeTab')} />} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={favs}
        keyExtractor={(p) => p._id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 12 }}
        contentContainerStyle={{ gap: 10, paddingVertical: 12, paddingBottom: 24 }}
        renderItem={({ item }) => <ProductCard p={item} />}
      />
    </View>
  );
}
