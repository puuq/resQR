const hexColour = /^#[a-f\d]{6}$/i;
function rgb(colour: string) {
  return [1, 3, 5].map((offset) => parseInt(colour.slice(offset, offset + 2), 16));
}
function mix(base: string, accent: string, amount: number) {
  const target = rgb(accent);
  return `#${rgb(base)
    .map((value, index) =>
      Math.round(value * (1 - amount) + target[index] * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
export function isLightMenuBackground(colour: string) {
  if (!hexColour.test(colour)) return false;
  const channels = rgb(colour).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 >= 0.75;
}
export function menuPalette(brand: string, custom = '') {
  const background = isLightMenuBackground(custom)
    ? custom
    : mix('#ffffff', hexColour.test(brand) ? brand : '#285847', 0.08);
  return { background, line: mix(background, '#25392e', 0.08) };
}
