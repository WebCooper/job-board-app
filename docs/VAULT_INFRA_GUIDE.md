# Persistent Vault Infrastructure for Kubernetes

This document provides instructions for setting up and maintaining a persistent HashiCorp Vault instance within a Minikube cluster for the Job Board application.

## Prerequisites
- Minikube
- Helm
- Kubectl

---

## 1. Clean Installation (Persistent Mode)
By default, "dev mode" stores secrets in memory. To make secrets permanent across cluster restarts, we use the following installation with Persistent Volume Support enabled:

```powershell
# Uninstall existing dev instance if necessary
helm uninstall vault

# Install with Persistent Volume Support
helm install vault hashicorp/vault `
  --set "server.dev.enabled=false" `
  --set "server.dataStorage.enabled=true" `
  --set "server.dataStorage.size=1Gi" `
  --set "injector.enabled=true"
```

---

## 2. One-Time Initialization
Because this is no longer a "dev" instance, you must manually initialize the security layer.

1. **Initialize Vault:**
   ```powershell
   kubectl exec vault-0 -- vault operator init
   ```
   **CRITICAL:** Save the **5 Unseal Keys** and the **Initial Root Token** provided in the output to a secure text file.

2. **Unseal Vault:**
   Run the following command **3 times**, using a different unseal key each time:
   ```powershell
   kubectl exec vault-0 -- vault operator unseal <Your-Key-Here>
   ```

---

## 3. Permanent Configuration
Run these commands once to configure the cluster integrations. They will be permanently saved to Vault's storage.

### Authentication & Secrets Engine
```powershell
# Login
kubectl exec vault-0 -- vault login <YOUR_ROOT_TOKEN>

# Enable KV Secrets Engine (Fixes 403 preflight errors)
kubectl exec vault-0 -- vault secrets enable -path=secret kv-v2

# Enable Kubernetes Auth
kubectl exec vault-0 -- vault auth enable kubernetes
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/config \
   kubernetes_host="https://kubernetes.default.svc" \
    token_reviewer_jwt="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
    kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
```

### Service Configuration (Jobs Service)
```powershell
# Store Database Secret
kubectl exec vault-0 -- sh -c 'vault kv put secret/jobs-service DATABASE_URL=postgresql://jobs_admin:jobs_password@postgres-jobs:5432/jobs_db'

# Create Policy
kubectl exec vault-0 -- sh -c 'printf "path \"secret/data/jobs-service\" {\n  capabilities = [\"read\"]\n}\n" > /tmp/jobs-policy.hcl; vault policy write jobs-policy /tmp/jobs-policy.hcl'

# Create Role for Service Account
# Note: Do not set audience unless your cluster SA token audience is explicitly configured to match.
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/role/jobs-role \
    bound_service_account_names=jobs-service-sa \
    bound_service_account_namespaces=default \
    policies=jobs-policy \
    ttl=24h'
```

### Service Configuration (Payment Service)
```powershell
# Store Database Secret
kubectl exec vault-0 -- sh -c 'vault kv put secret/payment-service DATABASE_URL=postgresql://payment_admin:payment_password@postgres-payment:5432/payment_db'

# Create Policy
kubectl exec vault-0 -- sh -c 'printf "path \"secret/data/payment-service\" {\n  capabilities = [\"read\"]\n}\n" > /tmp/payment-policy.hcl; vault policy write payment-policy /tmp/payment-policy.hcl'

# Create Role for Service Account
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/role/payment-role \
   bound_service_account_names=payment-service-sa \
   bound_service_account_namespaces=default \
   policies=payment-policy \
   ttl=24h'

# Apply Kubernetes manifests and validate rollout
kubectl apply -f k8s-manifests/payment-service-sa.yaml
kubectl apply -f k8s-manifests/payment-service.yaml
kubectl rollout status deployment/payment-service-deployment
kubectl get pods -o wide
kubectl describe deployment payment-service-deployment
```

### Troubleshooting: invalid audience (aud) claim
If payment pods are stuck during Vault init and logs show:

* invalid audience (aud) claim: audience claim does not match any expected audience

then recreate the role without audience:

```powershell
kubectl exec vault-0 -- sh -c 'vault delete auth/kubernetes/role/payment-role; vault write auth/kubernetes/role/payment-role \
   bound_service_account_names=payment-service-sa \
   bound_service_account_namespaces=default \
   policies=payment-policy \
   ttl=24h'

kubectl delete pod -l app=payment-service
kubectl rollout status deployment/payment-service-deployment
```

---

## 4. Maintenance After Restart
When Minikube is stopped and started, Vault will be **Sealed** (`0/1` containers ready). You **do not** need to re-run the configuration above.

**To restore service:**
1. Run `kubectl exec vault-0 -- vault operator unseal` (Repeat 3 times with your saved keys).
2. Vault will automatically become ready (`1/1`) and provide secrets to the pods again.
3. If the jobs-service pods are in an error state from waiting, restart them:
   ```powershell
   kubectl rollout restart deployment jobs-service-deployment
   ```