class CreateGirls < ActiveRecord::Migration[5.1]
  def change
    create_table :girls, &:timestamps
  end
end
