import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/config/app.config';

export default function App() {
  return (
    <div className="p-4">
      <h1>{APP_NAME}</h1>
      <Button>{APP_NAME}</Button>
    </div>
  );
}
