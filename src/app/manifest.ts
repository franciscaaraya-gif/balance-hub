
import { MetadataRoute } from 'next';
import { PlaceHolderImages } from './lib/placeholder-images';

export default function manifest(): MetadataRoute.Manifest {
  const icon192 = PlaceHolderImages.find(img => img.id === 'pwa-icon-192')?.imageUrl || 'https://picsum.photos/seed/zygos-v1/192/192';
  const icon512 = PlaceHolderImages.find(img => img.id === 'pwa-icon-512')?.imageUrl || 'https://picsum.photos/seed/zygos-v1/512/512';

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
        src: icon192,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: icon512,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
