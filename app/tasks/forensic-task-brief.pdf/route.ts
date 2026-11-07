export async function GET() {
  return new Response("Sign in to the student workspace to access academy-published files.", {status:410,headers:{"Cache-Control":"no-store"}});
}
