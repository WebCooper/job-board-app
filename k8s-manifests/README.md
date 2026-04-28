# Kubernetes Infrastructure (Minikube)

This directory contains Kubernetes manifests for the Job Board Platform.

## Prerequisites
- Docker Desktop
- Minikube
- kubectl
- Helm
- istioctl

## Phase 1: Core Services

1. Start cluster:

```bash
minikube start --driver=docker
```

2. Deploy services:

```bash
kubectl apply -f user-service.yaml
kubectl apply -f jobs-service.yaml
kubectl apply -f payment-service.yaml
kubectl apply -f application-service.yaml
kubectl apply -f notification-service.yaml
```

3. Verify:

```bash
kubectl get pods
```

## Phase 2: Databases + Gateway

1. Deploy PostgreSQL instances:

```bash
kubectl apply -f postgres-jobs.yaml
kubectl apply -f postgres-payment.yaml
kubectl apply -f postgres-application.yaml
kubectl apply -f postgres-notifications.yaml
```

2. Install Kong:

```bash
helm repo add kong https://charts.konghq.com
helm repo update
helm install kong kong/ingress -n kong --create-namespace
```

3. Apply ingress routes:

```bash
kubectl apply -f kong-zitadel-jwt.yaml
kubectl apply -f ingress.yaml
```

4. Access gateway locally:

```bash
kubectl port-forward -n kong svc/kong-gateway-proxy 8000:80
```

The user-service auth endpoint is exposed through the service on port 80 and the container listens on 8089. Keep that port mapping aligned if you rebuild the manifest.

## Phase 3: Istio Service Mesh

1. Install Istio:

```bash
istioctl install --set profile=demo -y
```

2. Enable sidecar injection:

```bash
kubectl label namespace default istio-injection=enabled
kubectl label namespace kong istio-injection=enabled --overwrite
```

3. Restart workloads for sidecars:

```bash
kubectl rollout restart deployment user-service-deployment jobs-service-deployment payment-service-deployment application-service-deployment notification-service-deployment
```

4. Restart the Kong deployments so the Istio sidecar is injected:

```bash
kubectl get deployments -n kong
kubectl rollout restart deployment -n kong kong-controller
kubectl rollout restart deployment -n kong kong-gateway
```

Depending on the Helm chart version, the deployment name may be `kong-ingress-kong` or similar. Use the names returned by `kubectl get deployments -n kong`.

## Phase 4: Messaging + Scale

1. Deploy Redis and RabbitMQ:

```bash
kubectl apply -f redis-rabbitmq.yaml
```

2. Enable metrics server:

```bash
minikube addons enable metrics-server
```

3. Example HPA for jobs-service:

```bash
kubectl autoscale deployment jobs-service-deployment --cpu-percent=50 --min=1 --max=5
kubectl get hpa
```

## Phase 5: Vault Secrets for Jobs Service

This section reflects the tested working setup for jobs-service.

### 1. Install Vault with injector

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update
helm install vault hashicorp/vault --set "server.dev.enabled=true" --set "injector.enabled=true"
```

### 2. Configure Kubernetes auth in Vault

Important: in this environment, Kubernetes auth must include `token_reviewer_jwt` and `kubernetes_ca_cert`. If omitted, pods may fail with `403 permission denied` on `auth/kubernetes/login`.

```bash
kubectl exec vault-0 -- sh -c 'export VAULT_TOKEN=root; vault auth enable kubernetes'
kubectl exec vault-0 -- sh -c 'export VAULT_TOKEN=root; vault write auth/kubernetes/config kubernetes_host="https://kubernetes.default.svc" token_reviewer_jwt="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
```

### 3. Store secret + create policy + role

```bash
kubectl exec vault-0 -- sh -c 'export VAULT_TOKEN=root; vault kv put secret/jobs-service DATABASE_URL=postgresql://jobs_admin:jobs_password@postgres-jobs:5432/jobs_db'

kubectl exec vault-0 -- sh -c 'export VAULT_TOKEN=root; cat <<EOF >/tmp/jobs-policy.hcl
path "secret/data/jobs-service" {
  capabilities = ["read"]
}
EOF
vault policy write jobs-policy /tmp/jobs-policy.hcl'

kubectl exec vault-0 -- sh -c 'export VAULT_TOKEN=root; vault write auth/kubernetes/role/jobs-role bound_service_account_names=jobs-service-sa bound_service_account_namespaces=default policies=jobs-policy ttl=24h'
```

### 4. Jobs-service manifest requirements

In `jobs-service.yaml`, ensure:

- Service account is `jobs-service-sa`
- Vault injector annotations are present
- `DATABASE_URL` is not hardcoded in env
- Istio bypass is set for Vault init login:

```yaml
traffic.sidecar.istio.io/excludeOutboundPorts: "8200"
```

Without this Istio exclude rule, `vault-agent-init` can fail with connection refused while sidecar iptables are active.

### 5. Apply + validate

```bash
kubectl apply -f jobs-service-sa.yaml
kubectl apply -f jobs-service.yaml
kubectl rollout status deployment/jobs-service-deployment
kubectl get pods -l app=jobs-service -o wide
kubectl describe deployment jobs-service-deployment
```

Verify secret injection and service health:

```bash
kubectl exec <jobs-pod> -c vault-agent -- cat /vault/secrets/database
kubectl port-forward svc/jobs-service 3002:80
curl http://localhost:3002/health
```

Verify DB schema:

```bash
kubectl exec <postgres-jobs-pod> -- psql -U jobs_admin -d jobs_db -c "\\dt"
```

### 6. Local Minikube image note

For local validation with a locally built image tag, use:

- `imagePullPolicy: IfNotPresent`
- `minikube image load <image:tag>`

For CI/CD with pushed Docker Hub tags, switch back to your normal pull policy and use the published tag.
