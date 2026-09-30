import { Navigate } from "react-router-dom";

// All match confirmation paths use the server-owned approval and rating workflow.
export default function PendingMatches() {
  return <Navigate to="/player/matches?tab=pending" replace />;
}
