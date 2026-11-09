import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "../components/States";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-lg">
      <EmptyState icon={Compass} title="Page not found" message="The page you are looking for does not exist or you do not have access to it." action={<Link to="/" className="btn-primary">Back to dashboard</Link>} />
    </div>
  );
}
