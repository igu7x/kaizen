import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlaceholderProps {
  title: string;
}

export default function Placeholder({ title }: PlaceholderProps) {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-2">
            Esta página está em desenvolvimento
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Em Breve</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              O conteúdo desta página será implementado em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}