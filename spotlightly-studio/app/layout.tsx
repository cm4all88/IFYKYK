import type {ReactNode} from 'react';

export const metadata = {
  title: 'Spotlightly Video Studio',
  description: 'Build and preview Spotlightly marketing videos from any computer.',
};

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <body style={{margin: 0, background: '#F2EDE3'}}>{children}</body>
    </html>
  );
}
