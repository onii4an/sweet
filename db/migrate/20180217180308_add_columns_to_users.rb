class AddColumnsToUsers < ActiveRecord::Migration[5.1]
  def change
    add_column :users, :in_a_conversation, :boolean, default: false
  end
end
