# Zitadel + Istio + Kong Setup

This guide maps your requirements to the current stack (Zitadel instead of Okta).

## 1) Istio service mesh (mTLS + observability + circuit breaking)

Apply mesh security/circuit-breaker policy:

```powershell
kubectl apply -f k8s-manifests/istio-mesh-policies.yaml
```

Open Kiali dashboard:

```powershell
istioctl dashboard kiali
```

What this gives you:
- `PeerAuthentication` in `STRICT` mode for mTLS inside `default` namespace.
- `DestinationRule` for `jobs-service` with outlier detection and connection pool controls (circuit-breaker behavior).

## 2) Kong gateway plugins (rate limit + request logging)

Apply plugins and ingress:

```powershell
kubectl apply -f k8s-manifests/kong-plugins.yaml
kubectl apply -f k8s-manifests/kong-zitadel-jwt.yaml
kubectl apply -f k8s-manifests/ingress.yaml
```

Rate limit is set to **100 requests/minute** on gateway routes that use the ingress.

## 3) Zitadel JWT validation at Kong (Okta equivalent)

Because your project uses Zitadel, configure Kong JWT plugin with Zitadel issuer/public key.

1. Edit placeholders in `k8s-manifests/kong-zitadel-jwt.yaml`:
   - `https://<your-zitadel-domain>`
   - `REPLACE_WITH_ZITADEL_RS256_PUBLIC_KEY`
2. Apply the resource:

```powershell
kubectl apply -f k8s-manifests/kong-zitadel-jwt.yaml
```

3. Attach JWT plugin to ingress (add `zitadel-jwt`):

```yaml
metadata:
  annotations:
    konghq.com/plugins: global-rate-limit,request-logging,zitadel-jwt
```

Then re-apply ingress:

```powershell
kubectl apply -f k8s-manifests/ingress.yaml
```

Once applied, requests to `/api/v1/users`, `/api/v1/jobs`, `/api/v1/payments`, and `/api/v1/application` must include a valid Zitadel bearer token before Kong forwards them upstream.

## 4) API versioning at gateway

Already configured in `k8s-manifests/ingress.yaml`:
- `/api/v1/jobs` -> jobs service (backward compatible)
- `/api/v2/jobs` -> jobs service (salary filter + pagination metadata)

Both versions run simultaneously.

## 5) Notes about claims/roles

- Kong validates JWT signature + expiry at the gateway.
- Services should still read `sub` and role/group claims from JWT for authorization decisions.
- With Zitadel, role claims often arrive under custom claim namespaces; confirm your exact claim path and map it in service logic.
