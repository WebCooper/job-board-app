Here is the complete, fully updated `README.md`. I have added the **Notification Database** to Phase 2, and I created a brand new **Phase 5: Security & Secrets Management** section to document your incredible work with HashiCorp Vault!

I also cleaned up some of the URL markdown formatting so it renders perfectly in GitHub.

Copy and paste this entire block to replace your `k8s-manifests/README.md` file:

```markdown
# Kubernetes Infrastructure (Minikube)

This directory contains the Kubernetes manifests for the Job Board Platform.

## Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop/) installed and running.
- [Minikube](https://minikube.sigs.k8s.io/docs/start/) installed.
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed.
- [Helm](https://helm.sh/docs/intro/install/) installed (Package manager for Kubernetes).
- [Istioctl](https://istio.io/latest/docs/setup/getting-started/#download) installed (Istio CLI).

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
   kubectl apply -f application-service.yaml
   kubectl apply -f notification-service.yaml
   ```

3. **Verify running pods:**
   ```bash
   kubectl get pods
   ```

---

## Phase 2: Databases & API Gateway

1. **Deploy the PostgreSQL Databases:**
   These are the isolated databases for the database-per-service architecture.
   ```bash
   kubectl apply -f postgres-jobs.yaml
   kubectl apply -f postgres-payment.yaml
   kubectl apply -f postgres-application.yaml
   kubectl apply -f postgres-notifications.yaml
   ```

2. **Install Kong API Gateway (via Helm):**
   We use the official Helm chart to deploy the modern, split-architecture Kong gateway into its own namespace.
   ```bash
   helm repo add kong [https://charts.konghq.com](https://charts.konghq.com)
   helm repo update
   helm install kong kong/ingress -n kong --create-namespace
   ```
   *(Note: Wait for the gateway pod to finish downloading and initializing by running `kubectl get pods -n kong -w` before proceeding).*

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
   - `http://localhost:8000/api/v1/applications`

---

## Phase 3: Istio Service Mesh & Observability

We use Istio to automatically inject Envoy proxy sidecars into all of our pods. This encrypts all internal inter-service communication (mTLS) and provides deep traffic observability.

1. **Install Istio into the cluster:**
   ```bash
   istioctl install --set profile=demo -y
   ```

2. **Enable Automatic Sidecar Injection:**
   Label the default namespace so Istio knows to inject proxies into our apps.
   ```bash
   kubectl label namespace default istio-injection=enabled
   ```

3. **Restart Deployments to Inject Proxies:**
   ```bash
   kubectl rollout restart deployment user-service-deployment jobs-service-deployment payment-service-deployment application-service-deployment notification-service-deployment
   ```
   *(Run `kubectl get pods` and ensure the READY column shows `2/2` for all core services).*

4. **Install Observability Tools (Kiali & Prometheus):**
   ```bash
   kubectl apply -f [https://raw.githubusercontent.com/istio/istio/release-1.21/samples/addons/prometheus.yaml](https://raw.githubusercontent.com/istio/istio/release-1.21/samples/addons/prometheus.yaml)
   kubectl apply -f [https://raw.githubusercontent.com/istio/istio/release-1.21/samples/addons/kiali.yaml](https://raw.githubusercontent.com/istio/istio/release-1.21/samples/addons/kiali.yaml)
   ```

5. **Access the Kiali Dashboard:**
   To view the live visual map of the microservice network, forward the Kiali port to your local machine:
   ```bash
   kubectl port-forward -n istio-system svc/kiali 20001:20001
   ```
   Then navigate to `http://localhost:20001` in your browser and go to the **Graph** tab. Generate traffic through the Kong gateway to see the network map update in real-time.

---

## Phase 4: Asynchronous Messaging & Scalability

To support high traffic and decoupled background processing, we deploy caching, message queues, and pod autoscaling.

1. **Deploy Redis & RabbitMQ:**
   Redis handles job search caching, while RabbitMQ acts as the message broker for the Saga orchestration and email notifications.
   ```bash
   kubectl apply -f redis-rabbitmq.yaml
   ```

2. **Enable the Metrics Server:**
   Kubernetes needs the metrics server to monitor CPU usage for autoscaling decisions.
   ```bash
   minikube addons enable metrics-server
   ```
   *(Verify it is working by running `kubectl top nodes` to see CPU/Memory stats).*

3. **Configure the Horizontal Pod Autoscaler (HPA):**
   *(Note: The deployment manifests must have `resources.requests.cpu` defined for this to work).*
   Create an autoscaler for the `jobs-service` that dynamically scales between 1 and 5 pods if average CPU usage exceeds 50%:
   ```bash
   kubectl autoscale deployment jobs-service-deployment --cpu-percent=50 --min=1 --max=5
   ```
   Verify the HPA is active:
   ```bash
   kubectl get hpa
   ```

4. **Demonstrating Scalability (Load Testing):**
   To prove the HPA works during a demo, generate massive traffic against the Jobs API through the Kong Gateway (e.g., using tools like `hey`, `k6`, or Apache Bench). You will see Kubernetes automatically spin up additional `jobs-service` replicas to handle the load.

---

## Phase 5: Security & Secrets Management (HashiCorp Vault)

We use HashiCorp Vault to securely store database credentials and dynamically inject them directly into our pods at startup, completely removing the need for hardcoded passwords in our YAML files.

1. **Install Vault (via Helm):**
   Deploy Vault in development mode with the sidecar injector enabled.
   ```bash
   helm repo add hashicorp [https://helm.releases.hashicorp.com](https://helm.releases.hashicorp.com)
   helm repo update
   helm install vault hashicorp/vault --set "server.dev.enabled=true" --set "injector.enabled=true"
   ```

2. **Configure Vault & Store Secrets:**
   Exec into the Vault pod to enable Kubernetes authentication and store the database URLs securely.
   ```bash
   kubectl exec -it vault-0 -- sh
   
   # Inside the Vault shell, run:
   vault auth enable kubernetes
   vault write auth/kubernetes/config kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443"
   vault kv put secret/jobs-service DATABASE_URL="postgres://jobs_admin:jobs_password@postgres-jobs:5432/jobs_db"
   
   # Create policy and role
   vault policy write jobs-policy - <<EOF
   path "secret/data/jobs-service" {
     capabilities = ["read"]
   }
   EOF
   
   vault write auth/kubernetes/role/jobs-role \
       bound_service_account_names=jobs-service-sa \
       bound_service_account_namespaces=default \
       policies=jobs-policy \
       ttl=24h
       
   exit
   ```

3. **Inject Secrets via Annotations:**
   When defining a service (e.g., `jobs-service.yaml`), assign it a ServiceAccount (`jobs-service-sa`) and add the Vault annotations to the pod template. The Vault agent will automatically inject the decrypted credentials into `/vault/secrets/database.json` for the Node.js application to read!
```