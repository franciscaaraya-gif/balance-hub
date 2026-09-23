import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Dimensiones estándar recomendadas por Apple para touch icons
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width="100%" height="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        {/* Fondo sólido sin rx (redondeo) porque iOS aplica el suyo propio */}
        <rect x="0" y="0" width="200" height="200" fill="#1c2450"/>
        
        {/* Estructura del ábaco */}
        <rect x="30" y="30" width="140" height="140" rx="14" fill="none" stroke="#ffffff" strokeWidth="8"/>
        <line x1="40" y1="55" x2="160" y2="55" stroke="#ffffff" strokeWidth="5"/>
        <line x1="40" y1="88" x2="160" y2="88" stroke="#ffffff" strokeWidth="5"/>
        <line x1="40" y1="121" x2="160" y2="121" stroke="#ffffff" strokeWidth="5"/>
        <line x1="40" y1="154" x2="160" y2="154" stroke="#ffffff" strokeWidth="5"/>
        
        {/* Patrón de cuentas en Z */}
        <circle cx="50" cy="55" r="10" fill="#f56a56"/>
        <circle cx="83" cy="55" r="10" fill="#f56a56"/>
        <circle cx="117" cy="55" r="10" fill="#f56a56"/>
        <circle cx="150" cy="55" r="10" fill="#f56a56"/>
        
        <circle cx="50" cy="88" r="10" fill="#ffffff" stroke="#1c2450" strokeWidth="2.5"/>
        <circle cx="83" cy="88" r="10" fill="#ffffff" stroke="#1c2450" strokeWidth="2.5"/>
        <circle cx="117" cy="88" r="10" fill="#f56a56"/>
        <circle cx="150" cy="88" r="10" fill="#ffffff" stroke="#1c2450" strokeWidth="2.5"/>
        
        <circle cx="50" cy="121" r="10" fill="#ffffff" stroke="#1c2450" strokeWidth="2.5"/>
        <circle cx="83" cy="121" r="10" fill="#f56a56"/>
        <circle cx="117" cy="121" r="10" fill="#ffffff" stroke="#1c2450" strokeWidth="2.5"/>
        <circle cx="150" cy="121" r="10" fill="#ffffff" stroke="#1c2450" strokeWidth="2.5"/>
        
        <circle cx="50" cy="154" r="10" fill="#f56a56"/>
        <circle cx="83" cy="154" r="10" fill="#f56a56"/>
        <circle cx="117" cy="154" r="10" fill="#f56a56"/>
        <circle cx="150" cy="154" r="10" fill="#f56a56"/>
      </svg>
    ),
    { ...size }
  );
}
