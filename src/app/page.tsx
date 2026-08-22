import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <span className="text-lg font-semibold">SaaS Starter</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-gray-600 hover:text-gray-900">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Automate the operational work slowing your team down
        </h1>
        <p className="max-w-xl text-lg text-gray-600">
          A multi-tenant platform for small businesses — sign up, invite your
          team, and get to work in minutes.
        </p>
        <Link
          href="/signup"
          className="rounded-md bg-gray-900 px-6 py-3 text-white hover:bg-gray-700"
        >
          Get started for free
        </Link>
      </section>
    </main>
  );
}
