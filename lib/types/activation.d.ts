/**
 * Targeted client activation acknowledgement: install publishes the registry
 * only after the FIRST valid acknowledgement from the opaque initiating client
 * instance. Every connected browser may reconcile the graph, but only the
 * targeted controller may acknowledge the transaction; stale transactions,
 * wrong instances, wrong package/page/revision, and second acknowledgements
 * are rejected (spec §10.1).
 * @module @deepseek-ai/dsh-page-app-manager/activation
 */
import type { ActivationAcknowledgement, ClientActivationRequest, PageAppClientInstanceId, PageAppTransactionId } from './types.ts';
/**
 * One-shot activation gate. The manager opens it with the pending request
 * before applying the runtime layer; the first acknowledgement that matches
 * every field settles it. The gate is single-shot per transaction: it is
 * discarded after the transaction ends (success, rollback, or abort).
 */
export declare class PageAppActivationGate {
    private request;
    private settled;
    private readonly waiters;
    /** Whether an activation is currently pending. */
    get pending(): boolean;
    /** The pending request, when one exists (even after settlement). */
    get pendingRequest(): ClientActivationRequest | undefined;
    /**
     * Announce the pending activation. A second open without settlement throws —
     * one gate, one transaction.
     * @param request - the targeted activation request.
     * @throws {Error} when a request is already open.
     */
    open(request: ClientActivationRequest): void;
    /**
     * Wait for the first valid acknowledgement, bounded by a Host timeout.
     * Rejects when the gate is discarded before any acknowledgement arrives,
     * when the signal aborts, or when the timeout elapses first — a vanished
     * client can never hold the profile lock indefinitely in a live process.
     * @param signal - cancellation; an aborted wait rejects.
     * @param timeoutMs - Host cap on the settlement wait; elapsing rejects.
     * @returns the settled request.
     */
    awaitSettlement(signal: AbortSignal, timeoutMs: number): Promise<ClientActivationRequest>;
    /**
     * Try to settle the transaction with one client acknowledgement. Only the
     * first acknowledgement matching the pending request (transaction id,
     * client instance, package, page, revision) is accepted; anything else is
     * refused with its reason.
     * @param transactionId - the acknowledgement's transaction id.
     * @param clientInstanceId - the acknowledging client instance.
     * @param packageName - the acknowledged package.
     * @param pageId - the acknowledged page id.
     * @param graphRevision - the graph revision the client converged to.
     * @returns whether this attempt settled the gate.
     */
    acknowledge(transactionId: PageAppTransactionId, clientInstanceId: PageAppClientInstanceId, packageName: string, pageId: string, graphRevision: string): ActivationAcknowledgement;
    /** Discard the gate (rollback/abort path): pending waiters reject. */
    discard(): void;
}
//# sourceMappingURL=activation.d.ts.map