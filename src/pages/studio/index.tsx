import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function StudioRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/profile/me'); }, []);
  return null;
}
