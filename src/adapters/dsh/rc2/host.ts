/**
 * Host half of the exact DSH 0.1.1-rc.2 adapter.
 *
 * The implementation is kept separate from the stable bridge and feature
 * packages so RC2's bundle/profile-runtime differences cannot leak inward.
 */
export {
  RC2_HOST_ADAPTER_ENTRY_ID,
  RC2_HOST_DESCRIPTOR,
  apply,
} from '../../../host/legacy-rc2-compat.ts'
