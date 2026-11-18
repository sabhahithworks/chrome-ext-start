import { APP_NAME } from '@/config/app.config';

export default function HomeScreen() {
  return <h1 className="p-4 text-lg font-semibold">{APP_NAME}</h1>;
}
