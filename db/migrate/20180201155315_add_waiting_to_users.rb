class AddWaitingToUsers < ActiveRecord::Migration[5.1]
  def change
    add_column :users, :waiting, :boolean, default: false
  end
end
