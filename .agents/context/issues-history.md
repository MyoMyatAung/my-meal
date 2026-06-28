# ISSUES HISTORY

This markdown file list the issues history that encounter duing development process. Don't let it happen again.

-----

## Error Type
Console Error

## Phase 2: Auth + Layout

## Error Message
Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client. Consider using template tag instead (https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template).


    at script (<anonymous>:null:null)
    at ThemeProvider (components/theme-provider.tsx:11:5)
    at RootLayout (app/layout.tsx:26:9)

## Code Frame
   9 | }: React.ComponentProps<typeof NextThemesProvider>) {
  10 |   return (
> 11 |     <NextThemesProvider
     |     ^
  12 |       attribute="class"
  13 |       defaultTheme="system"
  14 |       enableSystem

Next.js version: 16.2.6 (Turbopack)

**Status: ** [FIXED]

-----

## Error Type
Recoverable Error

## Phase 2: Auth + Layout

## Error Message
Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch

  ...
    <HTTPAccessFallbackErrorBoundary pathname="/" notFound={{...}} forbidden={undefined} unauthorized={undefined} ...>
      <RedirectBoundary>
        <RedirectErrorBoundary router={{...}}>
          <InnerLayoutRouter url="/" tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} segmentPath={[...]} ...>
            <SegmentViewNode type="layout" pagePath="(dashboard...">
              <SegmentTrieNode>
              <script>
              <script>
              <script>
              <DashboardLayout>
                <div className="flex min-h...">
                  <Sidebar user={{name:"Vill...", ...}}>
                    <div>
                    <aside className="fixed top-...">
                      <div>
                      <nav>
                      <div>
                      <hr>
                      <div className="flex flex-...">
                        <button onClick={function onClick} className="flex items...">
                          <Sun className="size-4">
                            <svg
                              ref={null}
                              xmlns="http://www.w3.org/2000/svg"
                              width={24}
                              height={24}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
+                             className="lucide lucide-sun size-4"
-                             className="lucide lucide-moon size-4"
                              aria-hidden="true"
                            >
+                             <circle cx="12" cy="12" r="4">
-                             <path
-                               d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268..."
-                             >
                              ...
                          ...
                        ...
                  ...
          ...



    at circle (<anonymous>:null:null)
    at Sidebar (components/sidebar.tsx:146:15)
    at DashboardLayout (app/(dashboard)/layout.tsx:14:7)

## Code Frame
  144 |           >
  145 |             {resolvedTheme === "dark" ? (
> 146 |               <Sun className="size-4" />
      |               ^
  147 |             ) : (
  148 |               <Moon className="size-4" />
  149 |             )}

Next.js version: 16.2.6 (Turbopack)

**Status: ** [FIXED]

-----

## Error Type
Runtime Error

## Phase 2: Auth + Layout

## Error Message
TypeError: Cannot read properties of null (reading 'user')

    at DashboardLayout (app/(dashboard)/layout.tsx:14:24)

## Code Frame
  10 |   const session = await getServerSession(authOptions)
  11 | 
> 12 |   return (
     |     ^
  13 |     <div className="flex min-h-svh">
  14 |       <Sidebar user={session!.user} />

Next.js version: 16.2.6 (Turbopack)

**Status: ** [FIXED]

-----

## Error Type
Console Error

## Error Message
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch

  ...
    <HotReload globalError={[...]} webSocket={WebSocket} staticIndicatorState={{pathname:null, ...}}>
      <AppDevOverlayErrorBoundary globalError={[...]}>
        <ReplaySsrOnlyErrors>
        <DevRootHTTPAccessFallbackBoundary>
          <HTTPAccessFallbackBoundary notFound={<NotAllowedRootHTTPFallbackError>}>
            <HTTPAccessFallbackErrorBoundary pathname="/" notFound={<NotAllowedRootHTTPFallbackError>} ...>
              <RedirectBoundary>
                <RedirectErrorBoundary router={{...}}>
                  <Head>
                  <__next_root_layout_boundary__>
                    <SegmentViewNode type="layout" pagePath="layout.tsx">
                      <SegmentTrieNode>
                      <link>
                      <script>
                      <script>
                      <script>
                      <RootLayout>
                        <html lang="en" suppressHydrationWarning={true} className="antialiase...">
                          <head>
                          <body
-                           cz-shortcut-listen="true"
                          >
                  ...



    at body (<anonymous>:null:null)
    at RootLayout (app/layout.tsx:36:7)

## Code Frame
  34 |         <script dangerouslySetInnerHTML={{ __html: themeScript }} />
  35 |       </head>
> 36 |       <body>
     |       ^
  37 |         <ThemeProvider>{children}</ThemeProvider>
  38 |       </body>
  39 |     </html>

Next.js version: 16.2.6 (Turbopack)

**STATUS:** [FIXED]

-----

## Error Type
Console Error

## Phase 3: Dish Library

## Error Message
Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client. Consider using template tag instead (https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template).


    at script (<anonymous>:null:null)
    at RootLayout (app/layout.tsx:34:9)

## Code Frame
  32 |     >
  33 |       <head>
> 34 |         <script dangerouslySetInnerHTML={{ __html: themeScript }} />
     |         ^
  35 |       </head>
  36 |       <body suppressHydrationWarning>
  37 |         <ThemeProvider>{children}</ThemeProvider>

Next.js version: 16.2.6 (Turbopack)

**STATUS:** [FIXED]

-----

## Error Type
Recoverable Error

## Phase 3: Dish Library

## Error Message
Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch

  ...
    <HTTPAccessFallbackErrorBoundary pathname="/dishes" notFound={{...}} forbidden={undefined} unauthorized={undefined} ...>
      <RedirectBoundary>
        <RedirectErrorBoundary router={{...}}>
          <InnerLayoutRouter url="/dishes" tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} segmentPath={[...]} ...>
            <SegmentViewNode type="layout" pagePath="(dashboard...">
              <SegmentTrieNode>
              <script>
              <script>
              <script>
              <DashboardLayout>
                <div className="flex min-h...">
                  <Sidebar user={{name:"Vill...", ...}}>
                    <div>
                    <aside className="fixed top-...">
                      <div>
                      <nav>
                      <div>
                      <hr>
                      <div className="flex flex-...">
                        <button onClick={function onClick} className="flex items...">
                          <Sun className="size-4">
                            <svg
                              ref={null}
                              xmlns="http://www.w3.org/2000/svg"
                              width={24}
                              height={24}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
+                             className="lucide lucide-sun size-4"
-                             className="lucide lucide-moon size-4"
                              aria-hidden="true"
                            >
+                             <circle cx="12" cy="12" r="4">
-                             <path
-                               d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268..."
-                             >
                              ...
                          ...
                        ...
                  ...
          ...



    at circle (<anonymous>:null:null)
    at Sidebar (components/sidebar.tsx:150:15)
    at DashboardLayout (app/(dashboard)/layout.tsx:18:7)

## Code Frame
  148 |           >
  149 |             {isDarkTheme ? (
> 150 |               <Sun className="size-4" />
      |               ^
  151 |             ) : (
  152 |               <Moon className="size-4" />
  153 |             )}

Next.js version: 16.2.6 (Turbopack)

**STATUS:** [FIXED]

-----