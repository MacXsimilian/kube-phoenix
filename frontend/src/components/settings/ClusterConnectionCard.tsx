'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import LanguageIcon from '@mui/icons-material/Language'
import { getClusterInfo } from '@/lib/api'

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          fontWeight: 500
        }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={[{
          fontWeight: 500
        }, mono ? { fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' } : null]}>
        {value}
      </Typography>
    </Box>
  );
}

export default function ClusterConnectionCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.clusterInfo(),
    queryFn: getClusterInfo,
    staleTime: 5 * 60 * 1000, // cluster info changes very rarely
  })

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <LanguageIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{
            fontWeight: 700
          }}>
            Cluster Connection
          </Typography>
        </Box>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2.5
          }}>
          Kubernetes cluster information from the active kubeconfig or in-cluster service account.
        </Typography>

        {isError && (
          <Alert severity="error">Failed to load cluster information</Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {[0, 1, 2, 3].map((i) => (
              <Box key={i}>
                <Skeleton width={80} height={16} sx={{ mb: 0.5 }} />
                <Skeleton width={180} height={20} />
              </Box>
            ))}
          </Box>
        ) : data && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <InfoField label="API Server" value={data.apiServer} mono />
            <InfoField label="Cluster Name" value={data.clusterName} />
            <InfoField label="Kubernetes Version" value={data.kubernetesVersion} mono />
            <InfoField label="Auth Mode" value={data.authMode} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
