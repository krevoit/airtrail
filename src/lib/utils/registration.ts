// Countries that write registrations with a hyphen after the prefix, by
// prefix length. The US (N), Japan (JA) and South Korea (HL) don't.
const PREFIX_1 = new Set(['B', 'C', 'D', 'F', 'G', 'I', 'M']);
const PREFIX_2 = new Set(
  'VH ZK 9V 9M PK RP HS VT VN XA XB XC HP PR PP PT PS LV CC HK YV CN SU ET 5Y 9H EI EC PH OO SE OH LN OY TC A6 A7 A4 4X ZS EW UR RA OE OK SP HA YR LZ SX CS TF LX HB VP VQ ZP OB CX TI TG YS HR'.split(
    ' ',
  ),
);

/** "VHYIL" as "VH-YIL"; registrations with a hyphen already are left alone. */
export const formatRegistration = (registration: string) => {
  const value = registration.trim().toUpperCase();
  if (value.includes('-') || value.length < 4) return value;
  if (PREFIX_2.has(value.slice(0, 2))) {
    return `${value.slice(0, 2)}-${value.slice(2)}`;
  }
  if (PREFIX_1.has(value[0]!)) return `${value[0]}-${value.slice(1)}`;
  return value;
};
