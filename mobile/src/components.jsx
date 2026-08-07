import { ActivityIndicator, Image, Modal as RNModal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, F, STATUS_COLORS } from './theme.js';
import { money, img } from './api.js';

export const Spinner = () => (
  <View style={{ padding: 40, alignItems: 'center' }}>
    <ActivityIndicator size="large" color={C.brand} />
  </View>
);

export const Empty = ({ icon = '🤔', text, action }) => (
  <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
    <Text style={{ fontSize: 44 }}>{icon}</Text>
    <Text style={{ fontFamily: F.r, color: C.muted, textAlign: 'center' }}>{text}</Text>
    {action}
  </View>
);

export const Chip = ({ s, color }) => (
  <View style={[st.chip, { backgroundColor: (color || STATUS_COLORS[s] || C.muted) + '22' }]}>
    <Text style={{ fontFamily: F.sb, fontSize: 12, color: color || STATUS_COLORS[s] || C.muted, textTransform: 'capitalize' }}>
      {String(s).replaceAll('_', ' ')}
    </Text>
  </View>
);

export const Stars = ({ value = 0, onChange, size = 18 }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Text
        key={i}
        onPress={onChange ? () => onChange(i) : undefined}
        style={{ fontSize: size, color: i <= value ? C.amber : C.line }}
      >
        ★
      </Text>
    ))}
  </View>
);

export const Btn = ({ title, onPress, kind = 'primary', sm, block, disabled, style }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      st.btn,
      sm && st.btnSm,
      block && { alignSelf: 'stretch' },
      kind === 'gray' && { backgroundColor: '#e9e9e9' },
      kind === 'ghost' && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.brand },
      kind === 'danger' && { backgroundColor: C.red },
      disabled && { opacity: 0.5 },
      style,
    ]}
  >
    <Text
      style={{
        fontFamily: F.b,
        fontSize: sm ? 13 : 15,
        color: kind === 'gray' ? C.ink : kind === 'ghost' ? C.brand : '#fff',
        textAlign: 'center',
      }}
    >
      {title}
    </Text>
  </TouchableOpacity>
);

export const Card = ({ children, style, onPress }) => {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} style={[st.card, style]}>
      {children}
    </Wrap>
  );
};

export const Field = ({ label, children }) => (
  <View style={{ marginBottom: 12 }}>
    {!!label && <Text style={st.label}>{label}</Text>}
    {children}
  </View>
);

export const Input = (props) => (
  <TextInput
    placeholderTextColor="#a9a9a9"
    {...props}
    style={[st.input, props.multiline && { height: 84, textAlignVertical: 'top' }, props.style]}
  />
);

export const H2 = ({ children, style }) => <Text style={[st.h2, style]}>{children}</Text>;
export const Muted = ({ children, style, ...rest }) => (
  <Text {...rest} style={[{ fontFamily: F.r, color: C.muted, fontSize: 13 }, style]}>{children}</Text>
);
export const Bold = ({ children, style, ...rest }) => (
  <Text {...rest} style={[{ fontFamily: F.b, color: C.ink, fontSize: 14.5 }, style]}>{children}</Text>
);
export const Spread = ({ children, style }) => (
  <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, style]}>
    {children}
  </View>
);
export const Row = ({ children, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>
);

export const ErrorText = ({ children }) =>
  children ? <Text style={{ fontFamily: F.sb, color: C.red, marginTop: 6, fontSize: 13 }}>{children}</Text> : null;
export const SuccessText = ({ children }) =>
  children ? <Text style={{ fontFamily: F.sb, color: C.green, marginTop: 6, fontSize: 13 }}>{children}</Text> : null;

export const QtyCtl = ({ qty, set, max = 20 }) => (
  <View style={st.qty}>
    <TouchableOpacity onPress={() => set(qty - 1)} style={st.qtyBtn}><Text style={st.qtyTxt}>−</Text></TouchableOpacity>
    <Text style={{ fontFamily: F.b, minWidth: 26, textAlign: 'center' }}>{qty}</Text>
    <TouchableOpacity onPress={() => set(Math.min(max, qty + 1))} style={st.qtyBtn}><Text style={st.qtyTxt}>＋</Text></TouchableOpacity>
  </View>
);

/** Row of selectable chips — the mobile stand-in for <select>. */
export const ChipSelect = ({ options, value, onChange, style }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ gap: 8 }}>
    {options.map(([val, label]) => (
      <Pressable
        key={String(val)}
        onPress={() => onChange(val)}
        style={[st.selChip, value === val && { backgroundColor: C.brand, borderColor: C.brand }]}
      >
        <Text style={{ fontFamily: F.sb, fontSize: 13, color: value === val ? '#fff' : C.ink }}>{label}</Text>
      </Pressable>
    ))}
  </ScrollView>
);

export const CheckRow = ({ checked, onToggle, children }) => (
  <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
    <View style={[st.box, checked && { backgroundColor: C.brand, borderColor: C.brand }]}>
      {checked && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
    </View>
    <View style={{ flex: 1 }}>{children}</View>
  </Pressable>
);

export const RadioRow = ({ checked, onPress, children }) => (
  <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 }}>
    <View style={[st.radio, checked && { borderColor: C.brand }]}>
      {checked && <View style={st.radioDot} />}
    </View>
    <View style={{ flex: 1 }}>{children}</View>
  </Pressable>
);

export function Sheet({ title, onClose, children }) {
  return (
    <RNModal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} />
      <View style={st.sheet}>
        <Spread style={{ marginBottom: 12 }}>
          <Text style={{ fontFamily: F.b, fontSize: 18, color: C.ink }}>{title}</Text>
          <Text onPress={onClose} style={{ fontSize: 20, color: C.muted, padding: 4 }}>✕</Text>
        </Spread>
        <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </RNModal>
  );
}

export function ProductCard({ p, wide }) {
  const nav = useNavigation();
  const price = p.salePrice ?? p.price;
  return (
    <Card onPress={() => nav.push('Product', { id: p._id })} style={[{ flex: 1, overflow: 'hidden' }, wide && { width: 150, flex: undefined }]}>
      <Image source={{ uri: img(p.images?.[0]) }} style={{ width: '100%', height: wide ? 100 : 120, backgroundColor: C.line }} />
      <View style={{ padding: 10, gap: 3 }}>
        <Row>
          <Text style={{ fontSize: 10 }}>{p.isVeg ? '🟢' : '🔴'}</Text>
          <Text numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 13.5, color: C.ink, flex: 1 }}>{p.title}</Text>
        </Row>
        <Row>
          <Text style={{ fontFamily: F.b, color: C.brand, fontSize: 14 }}>{money(price)}</Text>
          {p.salePrice != null && p.salePrice < p.price && (
            <Muted style={{ textDecorationLine: 'line-through', fontSize: 12 }}>{money(p.price)}</Muted>
          )}
        </Row>
        {p.ratingCount > 0 && <Muted style={{ fontSize: 11.5 }}>★ {p.ratingAvg} ({p.ratingCount})</Muted>}
      </View>
    </Card>
  );
}

export function StoreCard({ s }) {
  const nav = useNavigation();
  const pp = s.partnerProfile || {};
  return (
    <Card onPress={() => nav.push('Store', { id: s._id })} style={{ flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' }}>
      <Image source={{ uri: img(pp.logo) || 'https://picsum.photos/seed/store/200' }} style={{ width: 58, height: 58, borderRadius: 12, backgroundColor: C.line }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Bold>{pp.storeName}</Bold>
        <Muted numberOfLines={1}>{[pp.city, ...(pp.cuisineTags || []).slice(0, 3)].filter(Boolean).join(' · ')}</Muted>
        <Row>
          {pp.ratingCount > 0 && <Text style={{ fontFamily: F.sb, fontSize: 12, color: C.amber }}>★ {pp.ratingAvg}</Text>}
          <Chip s={pp.isOpen ? 'Open' : 'Closed'} color={pp.isOpen ? C.green : C.red} />
        </Row>
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  btn: {
    backgroundColor: C.brand,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSm: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 10 },
  label: { fontFamily: F.sb, fontSize: 13, color: C.ink, marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: F.r,
    fontSize: 14.5,
    color: C.ink,
  },
  h2: { fontFamily: F.b, fontSize: 19, color: C.ink },
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.brand,
    borderRadius: 10,
    overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 11, paddingVertical: 5 },
  qtyTxt: { fontFamily: F.b, fontSize: 16, color: C.brand },
  selChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#fff',
  },
  box: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center', marginTop: 2, backgroundColor: '#fff',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.brand },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 30,
    maxHeight: '85%',
  },
});
