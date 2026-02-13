import { type IBApiNext, type Contract, SecType } from '@stoqey/ib';
import type { ContractSpec } from '../../core/interfaces/index.js';
import type { Logger } from '../../services/logger.js';

/**
 * Resolves stock ticker symbols to full IBKR contract specifications.
 *
 * Caches resolved contracts for the lifetime of the instance so that
 * repeated lookups for the same symbol avoid redundant API round-trips.
 *
 * Only US equities (SecType.STK, currency USD, SMART routing) are supported.
 */
export class ContractResolver {
  /** Cache resolved contracts for session lifetime. */
  private readonly cache = new Map<string, ContractSpec>();

  constructor(private readonly logger: Logger) {}

  /**
   * Resolve a symbol to a full IBKR contract specification.
   * Uses the cache for repeat lookups.
   *
   * @param api - The connected IBApiNext instance
   * @param symbol - Stock ticker symbol (e.g., "AAPL", "SPY")
   * @returns ContractSpec with conId and full contract details
   * @throws Error if symbol cannot be resolved (e.g. IBKR error 200)
   */
  async resolve(api: IBApiNext, symbol: string): Promise<ContractSpec> {
    const upperSymbol = symbol.toUpperCase();

    // 1. Check cache first
    const cached = this.cache.get(upperSymbol);
    if (cached) {
      this.logger.debug({ symbol: upperSymbol }, 'Contract resolved from cache');
      return cached;
    }

    // 2. Build search contract for US equity via SMART routing
    const searchContract: Contract = {
      symbol: upperSymbol,
      secType: SecType.STK,
      exchange: 'SMART',
      currency: 'USD',
    };

    this.logger.debug({ symbol: upperSymbol }, 'Resolving contract via IBKR API');

    // 3. Call api.getContractDetails() which returns Promise<ContractDetails[]>
    let details;
    try {
      details = await api.getContractDetails(searchContract);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to resolve contract for "${upperSymbol}": ${message}`,
      );
    }

    // 4. Validate we got at least one result
    if (!details || details.length === 0) {
      throw new Error(
        `No security definition found for "${upperSymbol}". ` +
          'Verify the symbol is a valid US equity.',
      );
    }

    // For US equities via SMART routing we expect a single match.
    // If IBKR returns multiple, take the first (primary listing).
    if (details.length > 1) {
      this.logger.warn(
        { symbol: upperSymbol, count: details.length },
        'Multiple contract details returned; using first result',
      );
    }

    const detail = details[0];
    const contract = detail.contract;

    if (contract.conId == null) {
      throw new Error(
        `Resolved contract for "${upperSymbol}" is missing conId.`,
      );
    }

    // 5. Map to ContractSpec
    const spec: ContractSpec = {
      conId: contract.conId,
      symbol: upperSymbol,
      secType: String(contract.secType ?? SecType.STK),
      exchange: contract.exchange ?? 'SMART',
      currency: contract.currency ?? 'USD',
    };

    // 6. Cache and return
    this.cache.set(upperSymbol, spec);
    this.logger.info(
      { symbol: upperSymbol, conId: spec.conId },
      'Contract resolved successfully',
    );

    return spec;
  }

  /**
   * Check if a symbol is already cached.
   */
  isCached(symbol: string): boolean {
    return this.cache.has(symbol.toUpperCase());
  }

  /**
   * Clear the contract cache.
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Contract cache cleared');
  }
}
