export function SetupScreen({ message }: { message?: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">Panel de agentes</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Configurá Supabase para continuar</h1>
      {message ? <p className="mt-4 text-sm leading-6 text-muted">{message}</p> : null}
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6">
        <li>Creá un proyecto en Supabase.</li>
        <li>Ejecutá el SQL de supabase/migrations/20261002120000_init.sql en el editor SQL.</li>
        <li>Copiá .env.example a .env.local y completá la URL, la anon key y la service role key.</li>
        <li>Desactivá el registro público en Authentication.</li>
        <li>Creá el primer usuario y ejecutá select public.bootstrap_super_admin(&apos;tu-email&apos;);</li>
      </ol>
    </main>
  );
}
