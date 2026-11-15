export type Go = 'go' | 'risky' | 'nogo'

/** rules.json: NO-GO = not viable (or VIPER rule broken), RISKY = viable but a close call, GO = viable and not a close call. */
export const goOf = (viable: boolean, closeCall?: boolean | null, viper = false): Go => (!viable || viper ? 'nogo' : closeCall ? 'risky' : 'go')
