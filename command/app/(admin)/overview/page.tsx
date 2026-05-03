import { redirect } from 'next/navigation';

// Overview dashboard has moved to the root route (/).
// This redirect preserves any existing bookmarks to /overview.
export default function OverviewRedirect() {
  redirect('/');
}
