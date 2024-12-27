import Link from 'next/link';

const examples = [
  {
    title: 'useChat',
    link: '/chat',
  },
  {
    title: 'useChat2',
    link: '/chat2',
  },
];

export default function Home() {
  return (
    <main className="flex flex-col gap-2 p-4">
      {examples.map((example, index) => (
        <Link key={example.link} className="flex flex-row" href={example.link}>
          <div className="w-8 text-zinc-400">{index + 1}.</div>
          <div className="hover:underline">{example.title}</div>
        </Link>
      ))}
    </main>
  );
}
