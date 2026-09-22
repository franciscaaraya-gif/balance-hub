import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zygos - Gestión de Deudas',
    short_name: 'Zygos',
    description: 'Gestión inteligente de deudas grupales y división de gastos.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f1f3f7',
    theme_color: '#1d2a5a',
    icons: [
      {
        src: '/icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      },
    ],
  };
}
