# Job Board App - New Machine Bootstrap (Minikube + Vault + Istio)

This runbook brings up all 5 services, their databases, Redis/RabbitMQ, and Vault secret injection on a fresh machine.

Assumptions:
- You already have `minikube`, `kubectl`, `helm`, and `istioctl` installed.
- Vault is already initialized and unsealed with 3 keys.
- Commands below are written for PowerShell.

---

## 1) Start cluster and base components

```powershell
minikube start --driver=docker
minikube addons enable metrics-server
kubectl config use-context minikube
```

Install Istio and enable injection for `default` namespace:

```powershell
istioctl install --set profile=demo -y
kubectl label namespace default istio-injection=enabled --overwrite
```

---

## 2) Install Vault (injector enabled)

If Vault is not installed yet:

```powershell
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update
helm install vault hashicorp/vault `
  --set "server.dev.enabled=false" `
  --set "server.dataStorage.enabled=true" `
  --set "server.dataStorage.size=1Gi" `
  --set "injector.enabled=true"
```

If Vault was just installed, initialize once and unseal (skip if already done):

```powershell
kubectl exec vault-0 -- vault operator init
kubectl exec vault-0 -- vault operator unseal <KEY_1>
kubectl exec vault-0 -- vault operator unseal <KEY_2>
kubectl exec vault-0 -- vault operator unseal <KEY_3>
```

Verify Vault pod is healthy:

```powershell
kubectl get pod vault-0
```

---

## 3) Configure Vault Kubernetes auth + policies + roles + secrets

Set root token in your PowerShell session:

```powershell
$env:VAULT_TOKEN="<YOUR_ROOT_TOKEN>"
```

Enable engines/auth (idempotent in practice; ignore "already enabled" messages):

```powershell
kubectl exec vault-0 -- sh -c 'vault secrets enable -path=secret kv-v2'
kubectl exec vault-0 -- sh -c 'vault auth enable kubernetes'
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/config kubernetes_host="https://kubernetes.default.svc" token_reviewer_jwt="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
```

Create secrets (DB + Redis for jobs):

```powershell
kubectl exec vault-0 -- sh -c 'vault kv put secret/jobs-service DATABASE_URL=postgresql://jobs_admin:jobs_password@postgres-jobs:5432/jobs_db REDIS_URL=redis://redis:6379'
kubectl exec vault-0 -- sh -c 'vault kv put secret/payment-service DATABASE_URL=postgresql://payment_admin:payment_password@postgres-payment:5432/payment_db'
kubectl exec vault-0 -- sh -c 'vault kv put secret/application-service DATABASE_URL=postgresql://app_admin:app_password@postgres-application:5432/application_db'
kubectl exec vault-0 -- sh -c 'vault kv put secret/notification-service DB_HOST=postgres-notifications DB_PORT=5432 DB_USER=notif_admin DB_PASSWORD=notif_password DB_NAME=notif_db'
```

Create policies:

```powershell
kubectl exec vault-0 -- sh -c 'printf "path \"secret/data/jobs-service\" {\n  capabilities = [\"read\"]\n}\n" > /tmp/jobs-policy.hcl; vault policy write jobs-policy /tmp/jobs-policy.hcl'
kubectl exec vault-0 -- sh -c 'printf "path \"secret/data/payment-service\" {\n  capabilities = [\"read\"]\n}\n" > /tmp/payment-policy.hcl; vault policy write payment-policy /tmp/payment-policy.hcl'
kubectl exec vault-0 -- sh -c 'printf "path \"secret/data/application-service\" {\n  capabilities = [\"read\"]\n}\n" > /tmp/application-policy.hcl; vault policy write application-policy /tmp/application-policy.hcl'
kubectl exec vault-0 -- sh -c 'printf "path \"secret/data/notification-service\" {\n  capabilities = [\"read\"]\n}\n" > /tmp/notification-policy.hcl; vault policy write notification-policy /tmp/notification-policy.hcl'
```

Create Kubernetes auth roles:

```powershell
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/role/jobs-role bound_service_account_names=jobs-service-sa bound_service_account_namespaces=default policies=jobs-policy ttl=24h'
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/role/payment-role bound_service_account_names=payment-service-sa bound_service_account_namespaces=default policies=payment-policy ttl=24h'
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/role/application-role bound_service_account_names=application-service-sa bound_service_account_namespaces=default policies=application-policy ttl=24h'
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/role/notification-role bound_service_account_names=notification-service-sa bound_service_account_namespaces=default policies=notification-policy ttl=24h'
```

---

## 4) Deploy infra + service accounts + databases + services

From repo root:

```powershell
kubectl apply -f k8s-manifests/redis-rabbitmq.yaml

kubectl apply -f k8s-manifests/jobs-service-sa.yaml
kubectl apply -f k8s-manifests/payment-service-sa.yaml
kubectl apply -f k8s-manifests/application-service-sa.yaml
kubectl apply -f k8s-manifests/notification-service-sa.yaml

kubectl apply -f k8s-manifests/postgres-jobs.yaml
kubectl apply -f k8s-manifests/postgres-payment.yaml
kubectl apply -f k8s-manifests/postgres-application.yaml
kubectl apply -f k8s-manifests/postgres-notifications.yaml

kubectl apply -f k8s-manifests/user-service.yaml
kubectl apply -f k8s-manifests/jobs-service.yaml
kubectl apply -f k8s-manifests/payment-service.yaml
kubectl apply -f k8s-manifests/application-service.yaml
kubectl apply -f k8s-manifests/notification-service.yaml
```

Restart all services once after Vault auth/policies are in place:

```powershell
kubectl rollout restart deployment/user-service-deployment
kubectl rollout restart deployment/jobs-service-deployment
kubectl rollout restart deployment/payment-service-deployment
kubectl rollout restart deployment/application-service-deployment
kubectl rollout restart deployment/notification-service-deployment
```

---

## 5) Verify rollout and secret injection

```powershell
kubectl rollout status deployment/jobs-service-deployment --timeout=180s
kubectl rollout status deployment/payment-service-deployment --timeout=180s
kubectl rollout status deployment/application-service-deployment --timeout=180s
kubectl rollout status deployment/notification-service-deployment --timeout=180s
kubectl rollout status deployment/user-service-deployment --timeout=180s

kubectl get pods -o wide
```

Check Vault injected files:

```powershell
$jobsPod = kubectl get pod -l app=jobs-service -o jsonpath="{.items[0].metadata.name}"
kubectl exec $jobsPod -c vault-agent -- sh -c "cat /vault/secrets/database && echo '---' && cat /vault/secrets/redis"

$payPod = kubectl get pod -l app=payment-service -o jsonpath="{.items[0].metadata.name}"
kubectl exec $payPod -c vault-agent -- sh -c "cat /vault/secrets/database"

$appPod = kubectl get pod -l app=application-service -o jsonpath="{.items[0].metadata.name}"
kubectl exec $appPod -c vault-agent -- sh -c "cat /vault/secrets/database"

$notifPod = kubectl get pod -l app=notification-service -o jsonpath="{.items[0].metadata.name}"
kubectl exec $notifPod -c vault-agent -- sh -c "cat /vault/secrets/database"
```

---

## 6) Optional gateway setup (Kong)

```powershell
helm repo add kong https://charts.konghq.com
helm repo update
helm install kong kong/ingress -n kong --create-namespace
kubectl apply -f k8s-manifests/ingress.yaml
kubectl port-forward -n kong svc/kong-gateway-proxy 8000:80
```

---

## 7) After every Minikube restart

Vault will be sealed again. Unseal and restart app deployments:

```powershell
kubectl exec vault-0 -- vault operator unseal <KEY_1>
kubectl exec vault-0 -- vault operator unseal <KEY_2>
kubectl exec vault-0 -- vault operator unseal <KEY_3>

kubectl rollout restart deployment/jobs-service-deployment
kubectl rollout restart deployment/payment-service-deployment
kubectl rollout restart deployment/application-service-deployment
kubectl rollout restart deployment/notification-service-deployment
```

---

## Troubleshooting quick checks

```powershell
kubectl get pods -A
kubectl describe pod <pod-name>
kubectl logs <pod-name> -c <container-name>
kubectl logs deploy/vault-agent-injector --tail=200
```

If Vault init fails in injected pods, verify these three:
- Service account in deployment matches Vault role binding.
- `traffic.sidecar.istio.io/excludeOutboundPorts: "8200"` exists on Vault-injected deployments.
- Secrets/policies/roles were created for the correct names and namespaces.
