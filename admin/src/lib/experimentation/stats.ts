// Pure frequentist stats ported from the Go service's results.go, kept here for
// later use by a results endpoint. No DB access — given raw per-variant counts
// it produces the same z statistic and two-sided p-value as Go's math.Erfc.

// erfc is the complementary error function via the Abramowitz & Stegun 7.1.26
// rational approximation (|error| < 1.5e-7), matching Go's math.Erfc closely
// enough for significance testing.
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? ans : 2 - ans;
}

// twoProportionZ runs a pooled two-proportion z-test of variant A against
// control B, returning the z statistic and two-sided p-value.
export function twoProportionZ(
  convA: number,
  expA: number,
  convB: number,
  expB: number
): { z: number; p: number } {
  if (expA === 0 || expB === 0) {
    return { z: 0, p: 1 };
  }
  const pA = convA / expA;
  const pB = convB / expB;
  const pPool = (convA + convB) / (expA + expB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / expA + 1 / expB));
  if (se === 0) {
    return { z: 0, p: 1 };
  }
  const z = (pA - pB) / se;
  const p = erfc(Math.abs(z) / Math.SQRT2);
  return { z, p };
}
