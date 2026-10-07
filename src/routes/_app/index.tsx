import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({ component: ProposalHomeRedirect });

function ProposalHomeRedirect() {
  return <Navigate to="/proposals" replace />;
}
