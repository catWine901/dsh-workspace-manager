# Changelog

## 1.0.1

- Fix external-consumer installation for public npm-form DSH 0.1.1-rc.2 by inlining the unpublished profile implementation, so ordinary npm users can install without a DSH source build.
- Provide an audited legacy compatibility bridge that is a no-op when the native ProfileRuntime capability exists.
- Publish the exact standalone dependency and peer boundary used by the Host and Client artifacts.

## 1.0.0

- Establish the out-of-tree Workspace Manager repository and package contract.
