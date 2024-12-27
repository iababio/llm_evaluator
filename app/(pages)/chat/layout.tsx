import Header from '@/components/header';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'useChat',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
