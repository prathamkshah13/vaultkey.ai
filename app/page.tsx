import Link from 'next/link'

export default function Home(){
  return (
    <main className= "min-h-screen bg-black flex flex-col items-center justify-center">
      <h1 className = "text-6xl font-bold text-white"> 
        Vault<span className= "text-blue-500">Key</span>
        </h1>
      <p className = "text-gray-400 mt-4 text-xl"> API Security for every developer</p>
      <nav aria-label="VaultKey" className="mt-6 flex gap-4 text-white">
        <a href="/auth/login">Sign in</a>
        <Link href="/scan">Scan code</Link>
        <Link href="/history">Scan history</Link>
        <a href="/auth/logout">Sign out</a>
      </nav>
    </main>
  )
}
