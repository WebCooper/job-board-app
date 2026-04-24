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

# Create Role for Service Account (with audience set to prevent JWT warnings)
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/role/jobs-role \
    bound_service_account_names=jobs-service-sa \
    bound_service_account_namespaces=default \
    policies=jobs-policy \
    audience=vault \
    ttl=24h'
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