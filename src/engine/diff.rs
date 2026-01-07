use crate::types::{AccountDiff, AccountSnapshot};

pub fn compute_account_diffs(
    pre: &[AccountSnapshot],
    post: &[AccountSnapshot],
) -> Vec<AccountDiff> {
    let mut diffs = Vec::new();
    for (p, q) in pre.iter().zip(post.iter()) {
        debug_assert_eq!(p.pubkey, q.pubkey);
        let data_changed = p.data != q.data;
        let lamports_changed = p.lamports != q.lamports;
        let owner_changed = p.owner != q.owner;
        if !data_changed && !lamports_changed && !owner_changed {
            continue;
        }
        diffs.push(AccountDiff {
            address: p.pubkey.to_string(),
            owner_before: Some(p.owner.to_string()),
            owner_after: Some(q.owner.to_string()),
            lamports_before: p.lamports,
            lamports_after: q.lamports,
            lamports_delta: q.lamports as i128 - p.lamports as i128,
            data_changed,
            data_len_before: p.data.len(),
            data_len_after: q.data.len(),
        });
    }
    diffs
}
