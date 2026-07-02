import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/desktop/playlists")({
  beforeLoad: () => { throw redirect({ to: "/playlists" }); },
});
