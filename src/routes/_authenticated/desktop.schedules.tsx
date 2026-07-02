import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/desktop/schedules")({
  beforeLoad: () => { throw redirect({ to: "/schedules" }); },
});
