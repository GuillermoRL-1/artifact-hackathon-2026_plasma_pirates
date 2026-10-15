import pandas as pd
import matplotlib.pyplot as plt

plot_data = pd.read_csv('uncertainties_data.csv', sep='\t')

n_sigma = 1

columns = plot_data.columns[2::2]
columns_std = plot_data.columns[3::2]
fig, ax = plt.subplots(2, 3, sharex=True, figsize=(12,12), layout='constrained')
for cc in plot_data.config.unique()[:3]:
    df = plot_data.query("config == @cc")
    for i, (col, col_u) in enumerate(zip(columns, columns_std)):
        row, column = divmod(i, 3)
        ax[row, column].plot(
            df.z_mm,
            df[col],
            label=f"Config {cc}",
        )
        ax[row, column].fill_between(
            df.z_mm,
            df[col] - n_sigma * df[col_u],
            df[col] + n_sigma * df[col_u],
            alpha=0.2,
        )
        ax[row, column].legend()

for i, col in enumerate(columns):
    row, column = divmod(i, 3)
    ax[row, column].set_title(col)

plt.show()
