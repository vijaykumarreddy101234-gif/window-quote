// S CRAFT brochure cross-section drawings (served from /profiles/<CODE>.png)
export const profileImg = code => (typeof window !== 'undefined' && ((window.__profRaw && window.__profRaw[code]) || (window.__profData && window.__profData[code]))) || `/profiles/${code}.png`
export const PROFILE_GROUPS = [
  ['Premium sliding series', ['RST-62T', 'RST-92T', 'RST-112T', 'RSS-59SS', 'RSS-67MS', 'RSS-84BS', 'RSM-53M', 'RSM-62MM', 'RSM-42SM', 'RSB-11.5DGB', 'RSB-24.5SB', 'RSI-44IL']],
  ['Eco-sliding series', ['RST-53ET', 'RST-80ET', 'RST-95ET', 'RSS-60ES', 'RSS-75ES', 'RSI-38EIL', 'RSB-17.5EB']],
  ['Eco-casement series', ['RSC-42EVF', 'RSM-42ESM', 'RSB-24.5ESB']],
  ['Casement series', ['RSC-42VF', 'RSC-60OF', 'RSC-72OF', 'RSC-74TM', 'RSC-78WO', 'RSC-74ZM', 'RSC-60FM', 'RSC-104OD', 'RSC-104ID', 'RSB-35CB']],
  ['Auxiliaries', ['RSA-HC', 'RSA-11MC', 'RSA-38TC', 'RSA-12P', 'RSA-22SA', 'RSM-68OM', 'RSA-92CJC', 'RSA-112CJC', 'RSA-50AT', 'RSA-25GB', 'RSA-60B', 'RSA-92B']],
]
export const groupOf = code => (PROFILE_GROUPS.find(g => g[1].includes(code)) || ['Other'])[0]
