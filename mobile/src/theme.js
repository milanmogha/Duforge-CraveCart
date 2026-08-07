// Official DapiGO theme (see repo CLAUDE.md)
export const C = {
  brand: '#00b3a6',
  brandDark: '#009288',
  brandLight: '#e0f7f5',
  ink: '#292929',
  bg: '#f7f7f7',
  card: '#ffffff',
  line: '#ebebeb',
  muted: '#767676',
  green: '#33bc88',
  red: '#ff4d4d',
  amber: '#fab44d',
};

export const F = {
  r: 'Quicksand_500Medium',
  sb: 'Quicksand_600SemiBold',
  b: 'Quicksand_700Bold',
};

export const STATUS_COLORS = {
  pending: C.amber,
  confirmed: C.brand,
  preparing: C.amber,
  ready: C.brand,
  assigned: C.brand,
  picked_up: C.brand,
  out_for_delivery: C.brand,
  delivered: C.green,
  completed: C.green,
  cancelled: C.red,
  refunded: C.red,
  open: C.amber,
  in_progress: C.brand,
  resolved: C.green,
  closed: C.muted,
  active: C.green,
  closed_store: C.red,
};
