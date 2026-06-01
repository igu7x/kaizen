import { useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { RenovacaoDetails } from '@/components/contratacoes/RenovacaoDetails';

export default function RenovacaoDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const renovacaoId = parseInt(id || '0');

  if (!renovacaoId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-400">ID da renovação inválido</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <RenovacaoDetails renovacaoId={renovacaoId} />
    </Layout>
  );
}































