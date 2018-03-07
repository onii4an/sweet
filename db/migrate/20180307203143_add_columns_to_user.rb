class AddColumnsToUser < ActiveRecord::Migration[5.1]
  def change
    add_column :users, :intro, :text, default: 'User has no status yet'
  end
end
