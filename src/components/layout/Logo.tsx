import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface LogoProps {
  className?: string;
  variant?: 'navbar' | 'footer';
}

export default function Logo({ className, variant = 'navbar' }: LogoProps) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <img 
        src="assets/Logo.webp" 
        alt="Merlux Chauffeur" 
        className={cn(
          "object-contain",
          variant === 'navbar' ? "h-10" : "h-16"
        )}
        referrerPolicy="no-referrer"
        onError={(e) => {
          // Fallback if image fails to load
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement?.classList.add('fallback-logo');
        }}
      />
    </Link>
  );
}
