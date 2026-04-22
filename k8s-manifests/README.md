
# Kubernetes Infrastructure (Minikube)

This directory contains the Kubernetes manifests for the Job Board Platform.

## Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop/) installed and running.
- [Minikube](https://minikube.sigs.k8s.io/docs/start/) installed.
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed.
- [Helm](https://helm.sh/docs/intro/install/) installed (Package manager for Kubernetes).

---

## Phase 1: Local Scaffolding (Core Services)

1. **Start the local cluster:**
   ```bash
   minikube start --driver=docker
   ```

2. **Deploy the microservices:**
   Navigate to this directory and apply the manifests:
   ```bash
   kubectl apply -f user-service.yaml
   kubectl apply -f jobs-service.yaml
   kubectl apply -f payment-service.yaml
   ```

3. **Verify running pods:**
   ```bash
   kubectl get pods
   ```

4. **Test a service locally (Port Forwarding):**
   To test a single service before the API Gateway is fully configured, forward the port to your local machine:
   ```bash
   kubectl port-forward svc/jobs-service 8090:80
   ```
   Then navigate to `http://localhost:8090` in your browser.

---

## Phase 2: Databases & API Gateway

1. **Deploy the PostgreSQL Databases:**
   These are the isolated databases for the database-per-service architecture.
   ```bash
   kubectl apply -f postgres-jobs.yaml
   kubectl apply -f postgres-payment.yaml
   ```

2. **Install Kong API Gateway (via Helm):**
   We use the official Helm chart to deploy the modern, split-architecture Kong gateway into its own namespace.
   ```bash
   helm repo add kong [https://charts.konghq.com](https://charts.konghq.com)
   helm repo update
   helm install kong kong/ingress -n kong --create-namespace
   ```
   *(Note: Wait for the gateway pod to finish downloading and initializing by running `kubectl get pods -n kong -w` before proceeding to the next step).*

3. **Apply the Routing Rules (Ingress):**
   Tell Kong how to route external traffic to the internal microservices.
   ```bash
   kubectl apply -f ingress.yaml
   ```

4. **Test the Gateway (The "Front Door"):**
   Forward the Kong Proxy port to your local machine:
   ```bash
   kubectl port-forward -n kong svc/kong-gateway-proxy 8000:80
   ```
   With the port forwarded, you can access the system via:
   - `http://localhost:8000/api/v1/jobs`
   - `http://localhost:8000/api/v1/users`
