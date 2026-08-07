import { ActivityIndicator, Modal as RNModal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { C, F, STATUS_COLORS } from './theme.js';

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
      kind === 'green' && { backgroundColor: C.green },
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

/** Row of selectable chips — the mobile stand-in for <select> / console tabs. */
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

/** Console-style stat card (label / big value / sub line). */
export const Stat = ({ label, value, sub }) => (
  <Card style={{ flexBasis: '47%', flexGrow: 1, padding: 14, gap: 3 }}>
    <Muted style={{ fontSize: 12 }}>{label}</Muted>
    <Text style={{ fontFamily: F.b, fontSize: 22, color: C.ink }}>{value}</Text>
    {!!sub && <Muted style={{ fontSize: 11.5 }}>{sub}</Muted>}
  </Card>
);

/** Tiny bar chart for the last-7-days sales (mirror of the console BarChart). */
export function Bars({ data, valueKey = 'total', labelKey = '_id' }) {
  if (!data?.length) return <Muted>No data yet.</Muted>;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120, paddingTop: 8 }}>
      {data.map((d) => (
        <View key={d[labelKey]} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View
            style={{
              alignSelf: 'stretch',
              height: Math.max(4, (d[valueKey] / max) * 90),
              backgroundColor: C.brand,
              borderRadius: 5,
              opacity: 0.85,
            }}
          />
          <Muted style={{ fontSize: 9.5 }}>{String(d[labelKey]).slice(5)}</Muted>
        </View>
      ))}
    </View>
  );
}

export const SwitchRow = ({ label, sub, value, onChange }) => (
  <Spread style={{ paddingVertical: 6 }}>
    <View style={{ flex: 1 }}>
      <Bold>{label}</Bold>
      {!!sub && <Muted style={{ fontSize: 12 }}>{sub}</Muted>}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: '#d5d5d5', true: C.brand }}
      thumbColor="#fff"
    />
  </Spread>
);

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
  selChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#fff',
  },
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
