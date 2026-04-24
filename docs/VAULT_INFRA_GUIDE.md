# Persistent Vault Infrastructure for Kubernetes

This document provides instructions for setting up and maintaining a persistent HashiCorp Vault instance within a Minikube cluster for the Job Board application.

Prerequisites
Minikube

Helm

Kubectl

1. Clean Installation (Persistent Mode)
By default, "dev mode" stores secrets in memory. To make secrets permanent, we use the following installation:

PowerShell
# Uninstall existing dev instance if necessary
helm uninstall vault

# Install with Persistent Volume Support
helm install vault hashicorp/vault `
  --set "server.dev.enabled=false" `
  --set "server.dataStorage.enabled=true" `
  --set "server.dataStorage.size=1Gi" `
  --set "injector.enabled=true"
2. One-Time Initialization
Because this is not a "dev" instance, you must initialize the security layer.

Initialize: kubectl exec vault-0 -- vault operator init

CRITICAL: Save the 5 Unseal Keys and Initial Root Token provided in the output.

Unseal: Run the following command 3 times, using a different unseal key each time:

kubectl exec vault-0 -- vault operator unseal <Your-Key-Here>

3. Permanent Configuration
Run these once to configure the cluster integrations.

Authentication & Secrets Engine
PowerShell
# Login
kubectl exec vault-0 -- vault login <YOUR_ROOT_TOKEN>

# Enable KV Secrets Engine
kubectl exec vault-0 -- vault secrets enable -path=secret kv-v2

# Enable Kubernetes Auth
kubectl exec vault-0 -- vault auth enable kubernetes
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/config kubernetes_host="https://kubernetes.default.svc" token_reviewer_jwt="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
Service Configuration (Jobs Service)
PowerShell
# Store Database Secret
kubectl exec vault-0 -- sh -c 'vault kv put secret/jobs-service DATABASE_URL=postgresql://jobs_admin:jobs_password@postgres-jobs:5432/jobs_db'

# Create Policy
kubectl exec vault-0 -- sh -c 'printf "path \"secret/data/jobs-service\" {\n  capabilities = [\"read\"]\n}\n" > /tmp/jobs-policy.hcl; vault policy write jobs-policy /tmp/jobs-policy.hcl'

# Create Role for Service Account
kubectl exec vault-0 -- sh -c 'vault write auth/kubernetes/role/jobs-role bound_service_account_names=jobs-service-sa bound_service_account_namespaces=default policies=jobs-policy ttl=24h'
4. Maintenance After Restart
When Minikube is stopped and started, Vault will be Sealed (0/1 containers ready). You do not need to re-run the configuration.

To restore service:

Run kubectl exec vault-0 -- vault operator unseal (Repeat 3 times with your saved keys).

Vault will automatically provide secrets to the pods again.